// 비밀번호를 환경변수에 넣을 해시로 바꿉니다 (원문은 어디에도 저장되지 않아요).  사용: node scripts/hash_secret.mjs "비밀번호"
import { scryptSync, randomBytes } from "node:crypto";
const v = process.argv[2];
if (!v) { console.error('사용법: node scripts/hash_secret.mjs "비밀번호"'); process.exit(1); }
const salt = randomBytes(16).toString("hex");
console.log("scrypt$" + salt + "$" + scryptSync(v, salt, 32).toString("hex"));
