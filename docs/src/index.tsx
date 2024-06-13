import { expand, F, render } from "@effectualjs/core";

import { App } from "./App.js";

const expanded = expand(<App />);
const rendered = render(expanded);

document.getElementById("root")!.innerHTML = rendered;
