/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    auth: import('./lib/auth').AuthContext | null;
    csrf: string;
  }
}
