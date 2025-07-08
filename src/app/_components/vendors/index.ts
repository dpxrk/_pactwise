// Regular exports (for backward compatibility)
export { VendorList } from './VendorList';
export { VendorDetail } from './VendorDetail';
export { VendorAnalytics } from './VendorAnalytics';
export { VendorCreateDialog } from './VendorCreateDialog';
export { VirtualizedVendorList } from './VirtualizedVendorList';

// Lazy-loaded exports (recommended for better performance)
export { LazyVendorList as VendorListLazy } from './LazyVendorList';
export { LazyVendorDetail as VendorDetailLazy } from './LazyVendorDetail';
export { LazyVendorAnalytics as VendorAnalyticsLazy } from './LazyVendorAnalytics';

// Default to lazy versions
export { default as VendorList } from './LazyVendorList';
export { default as VendorDetail } from './LazyVendorDetail';
export { default as VendorAnalytics } from './LazyVendorAnalytics';