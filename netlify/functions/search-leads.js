exports.handler = async (event) => {
    const token = process.env.APIFY_TOKEN;

    const niche =
        event.queryStringParameters?.query || "gym";

    const location =
        event.queryStringParameters?.location || "Kolkata";

    try {
        const input = {
            searchStringsArray: [
                `${niche} ${location}`
            ],
            maxCrawledPlacesPerSearch: 20,
            language: "en"
        };

        const runResponse = await fetch(
            `https://api.apify.com/v2/acts/compass~google-maps-scraper/run-sync-get-dataset-items?token=${token}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(input)
            }
        );

        const data = await runResponse.json();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: err.message
            })
        };
    }
};
