import "dotenv/config";
import { Client } from "@notionhq/client";
require("dotenv").config();

console.log(process.env.NOTION_DATABASE_ID);
console.log(process.env.NOTION_KEY);

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// https://www.northdetail.co.jp/blog/2123/
// Nuxt server middleware   :CORS

export async function addItem(text) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: text
              }
            }
          ]
        }
      }
    });
    console.log(response);
    console.log("Success! Entry added.");
  } catch (error) {
    console.error(error.body);
  }
}
