exports.handler = async (event) => {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  const query =
    event.queryStringParameters?.query || "gym";

  const location =
    event.queryStringParameters?.location || "Kolkata";

  try {
    const response = await fetch(
      `https://places-api.foursquare.com/places/search?query=${encodeURIComponent(
        query
      )}&near=${encodeURIComponent(location)}&limit=20`,
      {
        headers: {
          Authorization: apiKey,
          Accept: "application/json",
          "X-Places-Api-Version": "2025-06-01"
        }
      }
    );

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
