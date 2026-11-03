// The level registry. Add a level: write the data (see main.js, test.js), add it here, open ?level=<id>.
import main from "./main.js";
import { flat, hop, flight, mist, gallery } from "./test.js";

export const LEVELS = { main, flat, hop, flight, mist, gallery };
