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
import iconv from "iconv-lite";

const parseUrl = (content: string) => {
  const $ = cheerio.load(content);
  const result: { title: string; id: string; date: string }[] = [];
  $(`font[color="green"]`).each((index, el) => {
    const $el = $(el);
    const title = $el.text();
    const href = $el.parent().attr("href");
    const id = href && href.match(/htm_data\/(\S+)\.html/)[1];
    const date = $el
      .parent()
      .parent()
      .parent()
      .parent()
      .find(".f12")
      .first()
      .text();
    const item = { title, id, date };
    id && result.push(item);
  });
  return result;
};

const tClawer = async (url: string) => {
  axiosRetry(axios, { retries: 3 });
  const rsp = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "cache-control": "max-age=0",
      "accept-language": "zh-CN,zh;q=0.9,zh-HK;q=0.8,en;q=0.7",
      cookie:
        "__cfduid=db73534b3b3d577c4efba8d697c1c5cb31609937331; 227c9_lastvisit=0%091609937660%09%2Fthread0806.php%3Ffid%3D16%26search%3Ddigest",
      referer: "https://www.t66y.com/thread0806.php?fid=16",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36",
    },
    timeout: 10000,
  });
  const str = iconv.decode(Buffer.from(rsp.data), "gb2312");
  const html = iconv.encode(str, "utf8").toString();
  const result = parseUrl(html);

  return result;
};

const getImgNameByUrl = (url: string) => url.split("/").pop();

const parseImgUrl = (content: string) => {
  const $ = cheerio.load(content);
  const imgs: string[] = [];
  const post = $(".tpc_content").first();
  post.find("img").each((index, el) => {
    const href = $(el).attr("ess-data");

    if (!href) return;
    $(el).attr("src", "./" + getImgNameByUrl(href));
    href && imgs.push(href);
  });
  return { data: imgs, content: post.html() };
};

const readmeFile = join(ArchiveDir, "README.md");

export const downloadImg = async ({ id, title }: Post) => {
  const url = `https://www.t66y.com/htm_data/${id}.html`;
  const rsp = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "cache-control": "max-age=0",
      "accept-language": "zh-CN,zh;q=0.9,zh-HK;q=0.8,en;q=0.7",
      cookie:
        "__cfduid=db73534b3b3d577c4efba8d697c1c5cb31609937331; 227c9_lastvisit=0%091609937660%09%2Fthread0806.php%3Ffid%3D16%26search%3Ddigest",
      referer: "https://www.t66y.com/thread0806.php?fid=16",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36",
    },
    timeout: 10000,
  });

  const str = iconv.decode(Buffer.from(rsp.data), "gb2312");
  const html = iconv.encode(str, "utf8").toString();
  const result = parseImgUrl(html);

  const dir = join(ArchiveDir, id.replace(/\//g, "-"));

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

  await pMap(data, downloadImgThread, {
    concurrency: 10,
    stopOnError: false,
  });
  return;
};

export default tClawer;
