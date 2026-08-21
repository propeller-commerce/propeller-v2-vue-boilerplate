/**
 * Block-type → component map for <CmsPageRenderer> (cms-vue).
 *
 * Keyed by the typed block discriminator (`_type`) that the CMS provider emits
 * on a `CmsRichPage`. The 15 brand-styled block components live alongside this
 * file; register new block types here as the CMS model grows.
 */
import HeroBanner from './blocks/HeroBanner.vue'
import RichTextBlock from './blocks/RichTextBlock.vue'
import MediaBlock from './blocks/MediaBlock.vue'
import QuoteBlock from './blocks/QuoteBlock.vue'
import ValueProps from './blocks/ValueProps.vue'
import CallToAction from './blocks/CallToAction.vue'
import ProductCarousel from './blocks/ProductCarousel.vue'
import ContactForm from './blocks/ContactForm.vue'
import ProductSliderBlock from './blocks/ProductSliderBlock.vue'
import FeatureBlock from './blocks/FeatureBlock.vue'
import FAQBlock from './blocks/FAQBlock.vue'
import PostCardsBlock from './blocks/PostCardsBlock.vue'
import ProductCardsBlock from './blocks/ProductCardsBlock.vue'
import StaticBlock from './blocks/StaticBlock.vue'
import CategoryBanner from './blocks/CategoryBanner.vue'

export const cmsBlockRenderers: Record<string, unknown> = {
  'hero-banner': HeroBanner,
  'rich-text': RichTextBlock,
  media: MediaBlock,
  quote: QuoteBlock,
  'value-props': ValueProps,
  'call-to-action': CallToAction,
  'product-carousel': ProductCarousel,
  'contact-form': ContactForm,
  'product-slider': ProductSliderBlock,
  feature: FeatureBlock,
  faq: FAQBlock,
  'post-cards': PostCardsBlock,
  'product-cards': ProductCardsBlock,
  static: StaticBlock,
  'category-banner': CategoryBanner,
}
