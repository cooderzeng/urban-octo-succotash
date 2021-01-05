import { writeFileSync } from "fs";
import "reflect-metadata";
import { createConnection } from "typeorm";
import clawer from "./clawer";
import { Post } from "./entity/Post";

const sleep = async () => {
  return new Promise((resolve) => {
    const timeout = Math.random() * 1e4;
    setTimeout(() => resolve(true), Math.floor(timeout));
  });
};

createConnection()
  .then(async (connection) => {
    let num = 1;

    while (num <= 2) {
      try {
        console.log(`Running: page ${num}`);
        const data = await clawer(
          `https://f1113.wonderfulday30.live/forumdisplay.php?fid=19&orderby=dateline&filter=digest&page=${num}`
        );

        let postRepository = connection.getRepository(Post);
        let user = postRepository.create(data);
        await postRepository.save(user);

        await sleep();
      } catch (err) {
        writeFileSync("./error.log", JSON.stringify(err), { flag: "a" });
        console.log(`Error: page ${num}`);
        console.log("err: ", err);
      }
      num++;
    }
  })
  .catch((error) => console.log(error));
