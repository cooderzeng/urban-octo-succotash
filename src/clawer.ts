import axios from "axios";
import axiosRetry from "axios-retry";
import cheerio from "cheerio";
import filenamify from "filenamify";
import { createWriteStream, existsSync, writeFileSync } from "fs";
import makeDir from "make-dir";
import { EOL } from "os";
import pMap from "p-map";
import { join, relative, resolve } from "path";
import { Post } from "./entity/Post";
import { ArchiveDir, rootDir } from "./utils";

const parseUrl = (content: string) => {
  const $ = cheerio.load(content);
  const result: { title: string; id: string; date: string }[] = [];
  $(".subject").each((index, el) => {
    const $el = $(el);
    const ret = $el.find(`img[alt="帖子被加分"]`);
    if (ret.length > 0) {
      const link = $el.find("span a").first();
      const title = link.text().trim().split("\n").pop();
      const href = link.attr("href");
      const id = href && href.match(/.+tid=(\w+).+/)[1];
      const date = $el.next().find("em").first().text();
      const item = { title, id, date };
      id && result.push(item);
    }
  });
  return result;
};

const clawer = async (url: string) => {
  axiosRetry(axios, { retries: 3 });
  const rsp = await axios.get(url, {
    responseType: "text",
    headers: {
      authority: "f1113.wonderfulday30.live",
      method: "GET",
      scheme: "https",
      cookie:
        "__cfduid=d4821b7367a04469ca3772e00395c92471609769732; CzG_sid=tg1Iz7; CzG_visitedfid=19",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36",
    },
    timeout: 10000,
  });
  const result = parseUrl(rsp.data);
  return result;
};

const getImgNameByUrl = (url: string) => url.split("/").pop();

const parseImgUrl = (content: string) => {
  const $ = cheerio.load(content);
  const imgs: string[] = [];
  const post = $(".t_msgfontfix").first();
  post.find("img").each((index, el) => {
    const href = $(el).attr("file");

    if (!href) return;
    $(el).attr("src", "./" + getImgNameByUrl(href));
    href && imgs.push(href);
  });
  return { data: imgs, content: post.html() };
};

const readmeFile = join(ArchiveDir, "README.md");

export const downloadImg = async ({ id, title }: Post) => {
  const url = `https://f1113.wonderfulday30.live/viewthread.php?tid=${id}&extra=page%3D1%26amp%3Borderby%3Ddateline%26amp%3Bfilter%3Ddigest`;
  const rsp = await axios.get(url, {
    responseType: "text",
    headers: {
      authority: "f1113.wonderfulday30.live",
      method: "GET",
      scheme: "https",
      cookie:
        "__cfduid=d4821b7367a04469ca3772e00395c92471609769732; CzG_sid=tg1Iz7; CzG_visitedfid=19",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36",
    },
    timeout: 10000,
  });
  const result = parseImgUrl(rsp.data);

  const dir = join(ArchiveDir, id);

  if (!existsSync(dir)) {
    await makeDir(dir);
  }

  const downloadImgThread = async (url: string) => {
    const name = getImgNameByUrl(url);
    const filePath = resolve(dir, name);

    const writer = createWriteStream(filePath);

    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36",
      },
      timeout: 20000,
    });

    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error = null;
      writer.on("error", (err) => {
        error = err;
        writer.close();

        console.log(`img-download error: ${url}`);
        writeFileSync(
          "./img-download-failed.log",
          JSON.stringify({ id, url }),
          {
            flag: "a",
          }
        );
        console.log("err: ", err);

        resolve(err);
      });

      writer.on("close", () => {
        if (!error) {
          resolve(true);
        }
      });
    });
  };
  const { data, content } = result;

  const fileName = filenamify(title);
  const htmlFile = join(dir, `${fileName}.html`);
  writeFileSync(htmlFile, content);

  writeFileSync(
    readmeFile,
    `- [${fileName}](${relative(ArchiveDir, htmlFile)})` + EOL,
    {
      flag: "a",
    }
  );

  return pMap(data, downloadImgThread, {
    concurrency: 10,
    stopOnError: true,
  });
};

export default clawer;
