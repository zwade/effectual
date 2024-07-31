import { F } from "@effectualjs/core";

import { Count } from "./App.js";

export const Footer = () => {
    const count = Count.use();

    return <div>Copyright &copy;{2024 + count} Zach Wade</div>;
};
