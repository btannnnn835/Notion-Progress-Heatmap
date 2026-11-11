
export default async function handler(req, res) {
  const token = process.env.ENV_NOTION_TOKEN;
  const dataSourceId = process.env.ENV_DATABASE_ID;

  if (!token || !dataSourceId) {
    return res.status(500).json({
      error: "Missing Notion configuration"
    });
  }

  try {
    const results = [];
    let cursor;

    do {
      const response = await fetch(
        `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2025-09-03",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {})
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status}`);
      }

      results.push(...data.results);
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    const daily = new Map();

    for (const page of results) {
      const date = page.properties?.Date?.date?.start;
      const rating = page.properties?.Rating?.number;

      if (!date || rating === null ||
          rating === undefined ||
          rating < 1 || rating > 10) {
        continue;
      }

      const day = date.slice(0, 10);
      daily.set(day, rating);
    }

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json(
      Array.from(daily, ([date, rating]) => ({
        date,
        rating
      }))
    );
  } catch (error) {
    console.error("Heatmap error:", error.message);
    return res.status(500).json({
      error: "Could not load journal ratings"
    });
  }
}
