exports.handler = async (event) => {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  const query =
    event.queryStringParameters?.query || "gym";

  const location =
    event.queryStringParameters?.location || "Kolkata";

  try {
    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&near=${encodeURIComponent(location)}&limit=20`,
      {
        headers: {
          Accept: "application/json",
          Authorization: apiKey
        }
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
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
