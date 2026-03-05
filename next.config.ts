/*
 * @Author: cuby-kimmy
 * @LastEditors: kimmy
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'puppeteer'],
};

export default nextConfig;
