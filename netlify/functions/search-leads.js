exports.handler = async (event) => {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      apiKeyFound: !!apiKey
    })
  };
};
