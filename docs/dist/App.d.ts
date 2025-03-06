import { Store } from "@effectualjs/core";
import "./index.css";
export interface Props {
}
export declare const Count: Store<number>;
export declare const App: (props: Props) => import("@effectualjs/reconciler/dist/elements.mjs").EffectualElement;
