import { Module } from "@nestjs/common";
import { NewsService } from "./news.service";
import { ArticleService } from "./article.service";

@Module({
  providers: [NewsService, ArticleService],
  exports: [NewsService, ArticleService],
})
export class NewsModule {}
