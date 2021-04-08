import Koa from 'koa';
import Router from 'koa-router';

/* Create a Koa application instance. */
const app: Koa = new Koa();

/* Configure the application instance to use a router middleware. */
const router: Router = new Router();

router.get('/', (ctx: Koa.Context) => {
    ctx.body = { msg: 'Hello World!' };
});

app.use(router.allowedMethods());

app.use(router.routes());

/* Create and start an HTTP server. */
app.listen(3000, () => { console.log(`Server listening on port 3000`); });
