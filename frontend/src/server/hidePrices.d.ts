/** Types for hidePrices.js (plain JS so server.js can import it unbuilt). */
export declare const PRICE_FIELDS: ReadonlySet<string>
export declare function hidePrices<T>(data: T): T
export declare function pricesHidden(portalMode: string | undefined, signedIn: boolean): boolean
export declare const COST_PRICE_FIELDS: ReadonlySet<string>
export declare function withoutCostPrices<T>(data: T): T
export declare function forVisitor<T>(data: T, pricesHiddenFromViewer: boolean): T
