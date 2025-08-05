export default {
    async fetch(request, env, ctx) {
        return new Response(JSON.stringify({
            message: 'Hello from test worker!',
            url: request.url,
            method: request.method,
            timestamp: new Date().toISOString()
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
};
