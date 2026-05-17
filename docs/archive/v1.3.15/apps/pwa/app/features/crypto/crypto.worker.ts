import * as Comlink from "comlink";
import { CryptoServiceImpl } from "./crypto-service-impl";

// Create instance and expose it
const cryptoService = new CryptoServiceImpl();
Comlink.expose(cryptoService);
