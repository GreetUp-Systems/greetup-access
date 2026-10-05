// Static assets exported from Figma (logos). Next.js resolves them to their URL and size.
declare module "*.svg" {
  const asset: { src: string; width: number; height: number };
  export default asset;
}
