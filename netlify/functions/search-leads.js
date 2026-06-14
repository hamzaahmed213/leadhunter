exports.handler = async (event) => {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  try {
    return {
      statusCode: 200,
      body: JSON.stringify({
        keyExists: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error)
    };
  }
};
