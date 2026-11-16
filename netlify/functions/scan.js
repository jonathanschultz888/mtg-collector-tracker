export async function handler(event) {
  const params = event.queryStringParameters || {};
  const postalCode = params.postalCode || 'H2X 1Y4';
  const priceGoalCad = parseFloat(params.priceGoalCad || '50');

  try {
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD');
    const fxData = await fxRes.json();
    const fxRate = fxData?.rates?.CAD || 1.40;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        ok: true,
        postalCode,
        priceGoalCad,
        fxRate,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}
