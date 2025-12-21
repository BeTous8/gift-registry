/**
 * Transforms an Amazon URL to include affiliate tag
 * Supports: amazon.com, amazon.co.uk, a.co, amzn.to
 *
 * If no affiliate tag is configured (empty env var), returns the original URL unchanged.
 */
export function addAffiliateTag(url) {
  if (!url) return url;

  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;
  if (!tag) return url; // No tag configured, return original

  // Check if it's an Amazon URL
  const isAmazonUrl =
    url.includes('amazon.com') ||
    url.includes('amazon.co.') ||
    url.includes('amzn.to') ||
    url.includes('a.co/');

  if (!isAmazonUrl) return url; // Not Amazon, return as-is

  try {
    const urlObj = new URL(url);

    // Remove any existing affiliate tags to avoid conflicts
    urlObj.searchParams.delete('tag');
    urlObj.searchParams.delete('linkCode');
    urlObj.searchParams.delete('ref_');

    // Add our affiliate tag
    urlObj.searchParams.set('tag', tag);

    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, try simple string append
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tag=${tag}`;
  }
}
