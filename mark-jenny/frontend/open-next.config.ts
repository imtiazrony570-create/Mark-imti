import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cloudflare Pages / Workers config for the Mark-Imti Next.js frontend.
 *
 * The app has server-rendered routes, so it cannot be uploaded to Pages as a
 * plain static folder. The OpenNext adapter bundles the Next.js server into a
 * Worker, which is the supported way to run it on Cloudflare.
 */
export default defineCloudflareConfig();
