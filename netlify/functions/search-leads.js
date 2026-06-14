exports.handler = async () => {
  try {
    const response = await fetch("https://places-api.foursquare.com");

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: response.status,
        statusText: response.statusText
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack
      })
    };
  }
};
