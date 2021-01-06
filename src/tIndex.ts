import { writeFileSync } from "fs";
import "reflect-metadata";
import { createConnection } from "typeorm";

import { Tost } from "./entity/Tost";
import tClawer from "./tClawer";

const sleep = async () => {
  return new Promise((resolve) => {
    const timeout = Math.random() * 1e4;
    setTimeout(() => resolve(true), Math.floor(timeout));
  });
};

createConnection()
  .then(async (connection) => {
    let num = 2;

    while (num > 0) {
      try {
        console.log(`Running: page ${num}`);
        const data = await tClawer(
          `https://www.t66y.com/thread0806.php?fid=16&search=&page=${num}`
        );

        let tostRepository = connection.getRepository(Tost);
        let user = tostRepository.create(data);
        await tostRepository.save(user);

        await sleep();
      } catch (err) {
        writeFileSync("./error.log", JSON.stringify(err), { flag: "a" });
        console.log(`Error: page ${num}`);
        console.log("err: ", err);
      }
      num--;
    }
  })
  .catch((error) => console.log(error));
