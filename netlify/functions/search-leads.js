export async function handler(event) {
  const { keyword } = JSON.parse(event.body);

  const response = await fetch(
    "https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=apify_api_ofXFiYLmnc2B5HR0Jaqdwo3vgb0gSf1CAFHH",
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
}
