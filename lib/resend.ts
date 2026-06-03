import { Resend } from "resend";
import { checkEnv } from "./env";

export const resend = new Resend(checkEnv("RESEND_API_KEY"));
