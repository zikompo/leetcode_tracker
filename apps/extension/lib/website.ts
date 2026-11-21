import { browser } from "wxt/browser";
import { ACCOUNT_ENV } from "./account";

/** The LeetTrack website: the one dashboard, for the extension and the site alike. */
export const websiteUrl = (path = "/dashboard") => `${ACCOUNT_ENV.websiteUrl}${path}`;

export const openWebsite = (path = "/dashboard") =>
  void browser.tabs.create({ url: websiteUrl(path) });
