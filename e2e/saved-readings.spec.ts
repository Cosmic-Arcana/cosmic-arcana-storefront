import { askOnHome } from "./support/ask";
import {
  clearHistory,
  createReading,
  listHistory,
  uniqueQuestion,
  waitForHistory,
  type HistoryItem,
} from "./support/stack";
import { expect, test } from "./support/test";

/** "queen-of-swords" is shown as words, so the pattern accepts any capitalisation but no hyphens. */
const cardWords = (cardId: string): RegExp => new RegExp(cardId.replace(/-/g, "\\s+"), "i");

const seed = async (count: number, label: string): Promise<HistoryItem[]> => {
  const readings: HistoryItem[] = [];
  for (let index = 0; index < count; index += 1) {
    readings.push(await createReading(uniqueQuestion(`${label} ${index}`)));
  }
  await waitForHistory(readings.map((reading) => reading.spreadId));
  return readings;
};

test.beforeEach(async () => {
  await clearHistory();
});

test.describe("Feature: the list of saved readings", () => {
  test("Given no readings, When the user opens Saved, Then an empty state sends them back to ask", async ({
    page,
  }) => {
    await page.goto("/readings");

    const empty = page.getByTestId("readings-empty");
    await expect(empty).toBeVisible();
    await expect(empty.getByRole("link", { name: /ask|reading/i })).toHaveAttribute("href", "/");
  });

  test("Given two readings, When the user opens Saved, Then the newest is first and each shows its question", async ({
    page,
  }) => {
    const [older, newer] = await seed(2, "order");

    await page.goto("/readings");

    const items = page.getByTestId("readings-list").getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText(newer.question);
    await expect(items.nth(1)).toContainText(older.question);
  });

  test("Given a reading, When it is listed, Then it shows its cards and a readable date, not a raw timestamp", async ({
    page,
  }) => {
    const [reading] = await seed(1, "details");

    await page.goto("/readings");

    const item = page.getByTestId("readings-list").getByRole("listitem").first();
    await expect(item).toContainText(cardWords(reading.cards[0].cardId));
    await expect(item).not.toContainText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    await expect(item).toContainText(/\b20\d{2}\b/);
  });

  test("Given 25 readings, When the user opens Saved, Then 20 are listed and the older ones are one link away", async ({
    page,
  }) => {
    const readings = await seed(25, "paging");
    const oldest = readings[0];

    await page.goto("/readings");

    const items = page.getByTestId("readings-list").getByRole("listitem");
    await expect(items).toHaveCount(20);
    await expect(page.getByText(oldest.question)).toHaveCount(0);

    await page.getByRole("link", { name: "Older readings" }).click();

    await expect(page.getByText(oldest.question)).toBeVisible();
    await expect(page.getByTestId("readings-list").getByRole("listitem")).toHaveCount(5);
    await expect(page.getByRole("link", { name: "Older readings" })).toHaveCount(0);
  });
});

test.describe("Feature: a single saved reading", () => {
  test("Given a reading, When the user opens it from the list, Then the page shows the question, every card with its position, the prediction and the date", async ({
    page,
  }) => {
    const [reading] = await seed(1, "detail");
    await page.goto("/readings");

    await page.getByTestId("readings-list").getByRole("link").first().click();

    // Each part has its own element: the stub prediction happens to repeat the question and the
    // card names, so looking for them anywhere on the page would pass for the wrong reason.
    await expect(page.getByTestId("reading-question")).toHaveText(reading.question);
    const cards = page.getByTestId("reading-cards").getByRole("listitem");
    await expect(cards).toHaveCount(reading.cards.length);
    for (const [index, card] of reading.cards.entries()) {
      await expect(cards.nth(index)).toContainText(card.positionKey, { ignoreCase: true });
      await expect(cards.nth(index)).toContainText(cardWords(card.cardId));
      if (card.reversed) {
        await expect(cards.nth(index)).toContainText(/reversed/i);
      } else {
        await expect(cards.nth(index)).not.toContainText(/reversed/i);
      }
    }
    await expect(page.getByTestId("reading-prediction")).toContainText(reading.question);
    await expect(page.getByTestId("reading-date")).toContainText(/\b20\d{2}\b/);
    await expect(page.getByTestId("reading-date")).not.toContainText(/\d{4}-\d{2}-\d{2}T/);
    await expect(page.getByRole("link", { name: "Back to list" })).toHaveAttribute(
      "href",
      "/readings",
    );
  });

  test("Given 25 readings, When the oldest is opened by its address, Then it opens instead of being reported missing", async ({
    page,
  }) => {
    const readings = await seed(25, "deep link");
    const oldest = readings[0];

    await page.goto(`/readings/${oldest.spreadId}`);

    await expect(page.getByTestId("reading-missing")).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText(oldest.question);
  });

  test("Given an address no reading has, When it is opened, Then the page says it is not in the history", async ({
    page,
  }) => {
    await page.goto("/readings/6b0a0c0e-6a0e-4c45-9a52-0a2a52f7c1d1");

    await expect(page.getByTestId("reading-missing")).toContainText("not in your history");
  });

  test("Given an address that is not an id at all, When it is opened, Then the page says it is not in the history", async ({
    page,
  }) => {
    await page.goto("/readings/not-an-id");

    await expect(page.getByTestId("reading-missing")).toBeVisible();
  });

  test("Given a reading was just made, When the user opens it straight away, Then it is shown and never reported missing", async ({
    page,
  }) => {
    const question = uniqueQuestion("just made");
    await askOnHome(page, question);

    await page.getByRole("link", { name: "Open saved reading" }).click();

    await expect(page.getByTestId("reading-missing")).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText(question);
  });
});

test.describe("Feature: removing a saved reading", () => {
  test("Given a reading, When the user chooses to remove it, Then they are asked to confirm and cancelling keeps it", async ({
    page,
  }) => {
    const [reading] = await seed(1, "keep");
    await page.goto(`/readings/${reading.spreadId}`);

    await page.getByRole("button", { name: "Remove from history" }).click();

    await expect(page.getByText("Remove this reading?")).toBeVisible();
    await page.getByRole("button", { name: "Keep" }).click();

    await expect(page.getByText("Remove this reading?")).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText(reading.question);
    expect((await listHistory()).map((item) => item.spreadId)).toContain(reading.spreadId);
  });

  test("Given a reading, When removal is confirmed, Then it leaves the list and its address no longer opens", async ({
    page,
  }) => {
    const [reading] = await seed(1, "remove");
    await page.goto(`/readings/${reading.spreadId}`);

    await page.getByRole("button", { name: "Remove from history" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();

    await expect(page).toHaveURL(/\/readings$/);
    await expect(page.getByTestId("readings-empty")).toBeVisible();
    expect((await listHistory()).map((item) => item.spreadId)).not.toContain(reading.spreadId);

    await page.goto(`/readings/${reading.spreadId}`);
    await expect(page.getByTestId("reading-missing")).toBeVisible();
  });

  test("Given a reading that was already removed elsewhere, When the user confirms removal, Then they are told it is gone instead of a code", async ({
    page,
  }) => {
    const [reading] = await seed(1, "gone");
    await page.goto(`/readings/${reading.spreadId}`);
    await clearHistory();

    await page.getByRole("button", { name: "Remove from history" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(/already|no longer|not found|gone/i);
    await expect(page.getByRole("main").getByRole("alert")).not.toContainText(/delete 404|\b404\b/);
  });
});
