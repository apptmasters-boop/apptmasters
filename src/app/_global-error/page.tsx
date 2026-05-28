export const dynamic = "force-dynamic";

import ErrorPage from "../../components/ErrorPage";

interface Props {
  error: Error;
}

export default function GlobalErrorPage({ error }: Props) {
  return <ErrorPage error={error} />;
}
