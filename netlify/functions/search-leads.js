export async function handler(event) {
  try {
    const { keyword } = JSON.parse(event.body);

    const response = await fetch(
      "https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=" +
        process.env.APIFY_TOKEN,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          searchStringsArray: [keyword],
          maxCrawledPlacesPerSearch: 20,
        }),
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
