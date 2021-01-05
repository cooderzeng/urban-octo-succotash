import { writeFileSync } from "fs";
import "reflect-metadata";
import { createConnection } from "typeorm";
import clawer, { downloadImg } from "./clawer";
import { Post } from "./entity/Post";

const sleep = async () => {
  return new Promise((resolve) => {
    const timeout = Math.random() * 1e4;
    setTimeout(() => resolve(true), Math.floor(timeout));
  });
};

createConnection()
  .then(async (connection) => {
    const postRepository = connection.getRepository(Post);

    const result = await postRepository.find({
      where: { imgDownloaded: false },
      take: 40,
    });

    for (const post of result) {
      const { id, title } = post;
      try {
        console.log(`Running: postId ${id}`);
        const ret = await downloadImg(post);

        post.imgDownloaded = true;

        await postRepository.save(post);
        await sleep();
      } catch (err) {
        writeFileSync("./error.log", JSON.stringify(err), { flag: "a" });
        console.log(`Error: postId ${id}`);
        console.log("err: ", err);
      }
    }
  })
  .catch((error) => console.log(error));
