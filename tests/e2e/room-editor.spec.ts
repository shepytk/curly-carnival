import { expect, test } from "@playwright/test";

test("create a measured bathroom, place fixtures, reject overlap, undo, and reopen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Room width (mm)").fill("2400");
  await page.getByLabel("Room depth (mm)").fill("3000");
  await page.getByLabel("Wall height (mm)").fill("2400");
  await page.getByRole("button", { name: "Create design" }).click();

  await page.getByLabel("Opening type").selectOption("door");
  await page.getByLabel("Wall", { exact: true }).selectOption("south");
  await page.getByLabel("Offset from wall start (mm)").fill("100");
  await page.getByLabel("Width along wall (mm)").fill("800");
  await page.getByLabel("Height (mm)").fill("2000");
  await page.getByLabel("Door swing").selectOption("inward-left");
  await page.getByRole("button", { name: "Add opening" }).click();

  const fixtureForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add fixture" }) });
  await fixtureForm.getByLabel("Fixture name").fill("Vanity");
  await fixtureForm.getByLabel("Width (mm)").fill("1000");
  await fixtureForm.getByLabel("Depth (mm)").fill("500");
  await fixtureForm.getByLabel("X position (mm)").fill("50");
  await fixtureForm.getByLabel("Y position (mm)").fill("50");
  await fixtureForm.getByLabel("Rotation").selectOption("0");
  await fixtureForm.getByRole("button", { name: "Add fixture" }).click();

  await fixtureForm.getByLabel("Fixture name").fill("Shower");
  await fixtureForm.getByLabel("Width (mm)").fill("900");
  await fixtureForm.getByLabel("Depth (mm)").fill("900");
  await fixtureForm.getByLabel("X position (mm)").fill("1500");
  await fixtureForm.getByLabel("Y position (mm)").fill("1800");
  await fixtureForm.getByLabel("Rotation").selectOption("0");
  await fixtureForm.getByRole("button", { name: "Add fixture" }).click();
  const placed = page.getByRole("list", { name: "Placed fixtures" });
  await expect(placed.getByRole("button", { name: /Vanity/ })).toBeVisible();
  await expect(placed.getByRole("button", { name: /Shower/ })).toBeVisible();
  await page.locator(".selected-section").getByLabel("X position (mm)").fill("50");
  await page.locator(".selected-section").getByLabel("Y position (mm)").fill("50");
  await page.locator(".selected-section").getByRole("button", { name: "Apply position" }).click();
  await expect(page.getByRole("alert")).toContainText("overlaps another fixture");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(placed.getByRole("button", { name: /Shower/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(placed.getByRole("button", { name: /Shower/ })).toBeVisible();
  await page.getByRole("button", { name: "Save design" }).click();
  const savedProject = await page.evaluate(() => JSON.parse(localStorage.getItem("curly-carnival:current-project:v2") ?? "null"));
  expect(savedProject.schemaVersion).toBe(2);
  expect(savedProject.spaces[0].spaceType).toBe("bathroom");
  expect(savedProject.spaces[0].items.map((item: { displayName: string }) => item.displayName)).toEqual(["Vanity", "Shower"]);

  await page.reload();
  const reopened = page.getByRole("list", { name: "Placed fixtures" });
  await expect(reopened.getByRole("button", { name: /Vanity/ })).toBeVisible();
  await expect(reopened.getByRole("button", { name: /Shower/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Room openings" }).getByText("Door", { exact: false })).toBeVisible();
});

test("preserve unreadable local design data until the user backs it up and replaces it", async ({ page }) => {
  await page.goto("/");
  const unreadable = "{not-valid-json";
  await page.evaluate((value) => localStorage.setItem("room-design-studio:current-design:v1", value), unreadable);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Saved design needs attention" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("room-design-studio:current-design:v1"))).toBe(unreadable);

  await page.getByRole("button", { name: "Back up saved data and start a new design" }).click();
  expect(await page.evaluate(() => localStorage.getItem("room-design-studio:current-design:v1"))).toBe(unreadable);
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("room-design-studio:current-design:v1:recovery:")))).toBe(true);

  await page.getByLabel("Room width (mm)").fill("2400");
  await page.getByLabel("Room depth (mm)").fill("3000");
  await page.getByLabel("Wall height (mm)").fill("2400");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { name: "Plan your bathroom" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("curly-carnival:current-project:v2") ?? "null").schemaVersion)).toBe(2);
});
