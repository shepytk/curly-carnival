import { expect, test } from "@playwright/test";

test("create a measured bathroom, place fixtures, reject overlap, undo, and reopen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Plan your bathroom" }).waitFor();
  await page.getByRole("button", { name: "＋ Door" }).click();
  await page.getByRole("button", { name: "＋ Window" }).click();
  await page.getByRole("button", { name: /Vanity/ }).click();
  await page.getByRole("button", { name: /Shower/ }).click();
  const placed = page.getByRole("list", { name: "Placed fixtures" });
  await expect(placed.getByRole("button", { name: /Vanity/ })).toBeVisible();
  await expect(placed.getByRole("button", { name: /Shower/ })).toBeVisible();
  await page.getByLabel("X position (mm)").fill("50");
  await page.getByLabel("Y position (mm)").fill("50");
  await page.getByRole("button", { name: "Apply position" }).click();
  await expect(page.getByRole("alert")).toContainText("overlaps another fixture");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(placed.getByRole("button", { name: /Shower/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(placed.getByRole("button", { name: /Shower/ })).toBeVisible();
  await page.getByRole("button", { name: "Save design" }).click();

  await page.reload();
  const reopened = page.getByRole("list", { name: "Placed fixtures" });
  await expect(reopened.getByRole("button", { name: /Vanity/ })).toBeVisible();
  await expect(reopened.getByRole("button", { name: /Shower/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Room openings" }).getByText("Door", { exact: false })).toBeVisible();
});
