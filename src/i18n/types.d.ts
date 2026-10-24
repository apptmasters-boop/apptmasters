// next-intl knows the message keys (messages/en.json is the source), so a mistyped
// key fails the type check instead of showing on the page.
import type messages from "../../messages/en.json";
import type { Locale } from "./locales";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
