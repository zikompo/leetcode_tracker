import { describe, expect, it } from "vitest";
import {
  matchCheckUrl,
  matchSubmitUrl,
  parseCheckResponse,
  parseSubmitRequestBody,
  parseSubmitResponse,
} from "../parse";
import accepted from "../__fixtures__/check-accepted.json";
import quirk from "../__fixtures__/check-accepted-quirk.json";
import wa from "../__fixtures__/check-wrong-answer.json";
import ce from "../__fixtures__/check-compile-error.json";
import tle from "../__fixtures__/check-time-limit.json";
import re from "../__fixtures__/check-runtime-error.json";
import pending from "../__fixtures__/check-pending.json";
import startedState from "../__fixtures__/check-started.json";
import submitReq from "../__fixtures__/submit-request.json";
import submitRes from "../__fixtures__/submit-response.json";

const AT = "2026-11-14T00:00:00.000Z";

describe("url matching", () => {
  it("matches submit and check URLs", () => {
    expect(matchSubmitUrl("/problems/two-sum/submit/")).toBe("two-sum");
    expect(matchSubmitUrl("https://leetcode.com/problems/two-sum/submit/")).toBe("two-sum");
    expect(matchSubmitUrl("/problems/two-sum/interpret_solution/")).toBeNull();
    expect(matchCheckUrl("/submissions/detail/123/check/")).toBe("123");
    expect(matchCheckUrl("/submissions/detail/123/v2/check/")).toBe("123");
    expect(matchCheckUrl("/submissions/detail/runcode_1.2_abc/check/")).toBe("runcode_1.2_abc");
    expect(matchCheckUrl("/submissions/api/runtime_distribution/123/")).toBeNull();
  });
});

describe("submit", () => {
  it("parses request body (string or object) and response", () => {
    const req = parseSubmitRequestBody(JSON.stringify(submitReq));
    expect(req.lang).toBe("python3");
    expect(req.code).toContain("def twoSum");
    expect(parseSubmitRequestBody("not json")).toEqual({});
    expect(parseSubmitResponse("two-sum", submitRes, req, AT)).toMatchObject({
      type: "submission-started",
      slug: "two-sum",
      submissionId: "1234567890",
      lang: "python3",
    });
    expect(parseSubmitResponse("two-sum", { error: "x" }, req, AT)).toBeNull();
  });
});

describe("parseCheckResponse", () => {
  it("returns null while judging", () => {
    expect(parseCheckResponse("1", pending, AT)).toBeNull();
    expect(parseCheckResponse("1", startedState, AT)).toBeNull();
    expect(parseCheckResponse("1", "garbage", AT)).toBeNull();
  });
  it("parses Accepted with metrics", () => {
    expect(parseCheckResponse("1234567890", accepted, AT)).toEqual({
      type: "submission-result",
      submissionId: "1234567890",
      at: AT,
      status: "Accepted",
      accepted: true,
      lang: "python3",
      runtimeMs: 3,
      memoryMb: 17.53,
      runtimePercentile: 92.12,
      memoryPercentile: 45.68,
      source: "network",
    });
  });
  it.each([
    [wa, "Wrong Answer"],
    [ce, "Compile Error"],
    [tle, "Time Limit Exceeded"],
    [re, "Runtime Error"],
    [quirk, "Wrong Answer"],
  ])("parses failures (%#)", (fixture, status) => {
    const r = parseCheckResponse("x", fixture, AT);
    expect(r).toMatchObject({ status, accepted: false });
    expect(r?.runtimeMs).toBeUndefined();
  });
  it("treats a judge FAILURE as an internal error", () => {
    expect(parseCheckResponse("x", { state: "FAILURE" }, AT)).toMatchObject({
      status: "Internal Error",
      accepted: false,
    });
  });
});
