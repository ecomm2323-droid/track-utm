import { UtmBuilder } from "./utm-builder";

export const metadata = { title: "UTMs" };

export default function Utms() {
  return (
    <>
      <h1 className="text-lg font-semibold mb-4">UTMs</h1>
      <UtmBuilder />
    </>
  );
}
