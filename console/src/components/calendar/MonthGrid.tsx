'use client';
// The month as a drag-and-drop grid.
//
// Structurally the leads board's cousin: one DndContext, cells are droppables, bars are
// draggables, and the same PointerSensor(distance:5) lets a sub-5px press fall through to a click
// instead of starting a drag. The difference is the axis — a lead moves between five stage columns
// and reorders within one; a meeting moves between day cells and is NEVER hand-reordered within a
// day (bars are always sorted by start time). So there is no SortableContext and no order maths
// here: dropping a bar on a different day changes only its `day`, keeping its time (the conflict
// check + optimistic write live in CalendarView, which holds every meeting).

import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import type { Meeting } from '@/lib/meetingTypes';
import { compareByStart, monthMatrix, todayDay } from '@/lib/meetingTime';
import MeetingBar, { MeetingFace } from './MeetingBar';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DayCell({
  day, inMonth, dayNum, meetings, onOpenMeeting, onCreate,
}: {
  day: string;
  inMonth: boolean;
  dayNum: number;
  meetings: Meeting[];
  onOpenMeeting: (id: string) => void;
  onCreate: (day: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const today = todayDay();
  const isToday = day === today;
  const isPast = day < today;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onCreate(day)}
      className="group relative flex h-[132px] flex-col border-b border-r border-rule px-1.5 pb-1 pt-1.5 transition-colors last:border-r-0"
      style={{
        background: isOver
          ? 'var(--accent-glow)'
          : isToday
            ? 'transparent'
            : inMonth
              ? 'transparent'
              : 'var(--surface)',
        opacity: isPast && inMonth ? 0.56 : inMonth ? 1 : 0.82,
        boxShadow: isToday ? 'inset 0 0 0 2px var(--accent)' : undefined,
      }}
    >
      <div className="flex items-center justify-between px-0.5 pb-1">
        <span
          className="text-xs font-semibold"
          style={{ color: isToday ? 'var(--accent)' : inMonth ? 'var(--fg-2)' : 'var(--fg-3)' }}
        >
          {dayNum}
        </span>
        {isToday ? (
          <span className="meta" style={{ color: 'var(--accent)', fontSize: '9px' }}>
            Today
          </span>
        ) : (
          <span className="hidden text-fg3 group-hover:inline" aria-hidden>
            +
          </span>
        )}
      </div>

      {/* The scroll zone: a crowded day scrolls here on hover rather than growing the row. Clicks
          on empty space bubble to the cell (create); a bar stops its own click (see MeetingBar). */}
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto pr-px">
        {meetings.map((m) => (
          <MeetingBar key={m.id} meeting={m} onOpen={() => onOpenMeeting(m.id)} />
        ))}
      </div>
    </div>
  );
}

export default function MonthGrid({
  ym, meetings, onOpenMeeting, onCreate, onMove,
}: {
  /** The shown month, 'YYYY-MM'. */
  ym: string;
  meetings: Meeting[];
  onOpenMeeting: (id: string) => void;
  onCreate: (day: string) => void;
  /** A bar was dropped on a different day. CalendarView checks conflicts + persists. */
  onMove: (id: string, targetDay: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const [year, month0] = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    return [y, m - 1] as const;
  }, [ym]);

  const weeks = useMemo(() => monthMatrix(year, month0), [year, month0]);

  // day → meetings on that day, each list sorted earliest-first.
  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const arr = map.get(m.day);
      if (arr) arr.push(m);
      else map.set(m.day, [m]);
    }
    for (const arr of map.values()) arr.sort(compareByStart);
    return map;
  }, [meetings]);

  const byId = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const activeMeeting = activeId ? byId.get(activeId) ?? null : null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const id = String(active.id);
    const targetDay = String(over.id);
    const meeting = byId.get(id);
    if (!meeting || meeting.day === targetDay) return;
    onMove(id, targetDay);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[760px] overflow-hidden rounded-[14px] border border-rule" style={{ background: 'var(--panel)' }}>
          {/* Weekday header */}
          <div
            className="grid grid-cols-7 border-b border-rule"
            style={{ background: 'var(--panel-2)' }}
          >
            {DOW.map((d) => (
              <div key={d} className="meta px-2.5 py-2" style={{ fontSize: '10.5px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Six week rows */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map(({ day, inMonth }) => (
                <DayCell
                  key={day}
                  day={day}
                  inMonth={inMonth}
                  dayNum={Number(day.slice(8))}
                  meetings={byDay.get(day) ?? []}
                  onOpenMeeting={onOpenMeeting}
                  onCreate={onCreate}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeMeeting && (
          <div className="w-[200px] cursor-grabbing">
            <MeetingFace meeting={activeMeeting} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
