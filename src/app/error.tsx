"use client";

export const dynamic = "force-dynamic";

import ErrorPage from "../components/ErrorPage";

interface Props {
  error: Error;
  reset?: () => void;
}

export default function AppError({ error, reset }: Props) {
  return <ErrorPage error={error} reset={reset} />;
}
