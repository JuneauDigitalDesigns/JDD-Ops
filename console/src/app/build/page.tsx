import BuildWizard from './BuildWizard';

// The Build side is a 4-step wizard. All wizard state (content + builder, per client)
// lives in BuildWizard; the studio component catalog is built by buildCategories().
export default function Page() {
  return <BuildWizard />;
}
