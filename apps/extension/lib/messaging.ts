import { browser } from "wxt/browser";
import type { ApiArgs, ApiMethod, ApiRequest, ApiResponse, ApiResult } from "./types";

/** Typed request to the background service worker. Rejects with the handler's error message. */
export async function call<K extends ApiMethod>(
  method: K,
  ...args: ApiArgs<K>
): Promise<ApiResult<K>> {
  const request: ApiRequest<K> = { kind: "leettrack-api", method, args };
  const response = (await browser.runtime.sendMessage(request)) as
    ApiResponse<ApiResult<K>> | undefined;
  if (!response) throw new Error(`No response for ${method}`);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}
