exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      keyExists: !!process.env.FOURSQUARE_API_KEY
    })
  };
};
