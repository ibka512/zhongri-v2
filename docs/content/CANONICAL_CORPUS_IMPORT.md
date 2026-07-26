# Canonical corpus 导入记录

## 来源固定

- 仓库：[ibka512/jp-study](https://github.com/ibka512/jp-study)
- commit：`36c8129dfc364453198790b64687ff9105a3ecae`
- 资产目录：`wordbanks/assets.js`、`wordbanks/ja-001.js`–`ja-007.js`、
  `wordbanks/en-001.js`–`en-005.js`、`wordbanks/finalize.js`
- 资产目录树 SHA-1：`b3faa98bdd25ec3fddf0a87e3ca9f1f0053db387`
- 许可：MIT 与 CC BY-SA 4.0 衍生数据，详见
  [第三方内容与许可](./THIRD_PARTY_CONTENT.md)

## 转换结果

| 语言 | 源数组                | v2 资产                                | 数量  |
| ---- | --------------------- | -------------------------------------- | ----- |
| ja   | `DefaultWords`        | `src/content/canonical/assets/ja.json` | 5,906 |
| en   | `DefaultEnglishWords` | `src/content/canonical/assets/en.json` | 3,922 |
| 总计 | —                     | `jp-study-corpus-v1`                   | 9,828 |

原始 `_id` 原样保留为 v2 `id`，身份键始终是 `language:id`。当前资产验证结果：ID 无重复，
日语均有 `kana`，英语均有 `phonetic`，词头/词性/释义均非空。

## v2 字段映射

| jp-study 字段                  | v2 字段        | 规则                                            |
| ------------------------------ | -------------- | ----------------------------------------------- |
| `_id`                          | `id`           | 原样保留，不按数组位置重编号                    |
| `lang`                         | `language`     | 显式 `ja` / `en`                                |
| `word`                         | `headword`     | trim                                            |
| `kana`                         | `reading`      | 仅日语；必须非空                                |
| `phonetic`                     | `phonetic`     | 仅英语；必须非空                                |
| `type`                         | `partOfSpeech` | trim                                            |
| `meaning`                      | `meaning`      | trim                                            |
| `level`                        | `level`        | 空值归一化为 `UNSPECIFIED`（日语 3 条）         |
| `difficulty`                   | `difficulty`   | 非整数回退 0；本批均为整数 0                    |
| `tags`                         | `tags`         | trim、去空；本批无重复标签                      |
| `builtIn`                      | `isBuiltIn`    | 固定为 `true`                                   |
| `dataVersion`                  | `dataVersion`  | 缺失回退 1（两语言各 25 条 core）               |
| `sourceName` / `sourceVersion` | `source`       | 缺失的 core 来源标为仓库 commit，不伪造上游名称 |

`CanonicalWord v1` 当前不包含 `example`、`roots`、`folder`、`sourceLevels`、审核状态等
扩展字段，因此本切片不把这些字段静默塞入运行时对象；它们仍由固定源 commit 可追溯，后续
需要独立内容 Schema/资产任务才能发布。迁移业务域也不从这些 canonical 资产反造用户事实。

## 摘要与门禁

- `wordIdsSha256`：`792f7baafd2be3eaa4f267d3090381fb2552a7390305a516e24602eae9745ac5`
- `contentSha256`：`e1b2904c8fc695bf416f3130c527d9a2c4ac4b8f53a28ff35ec021f4e6a098df`
- `npm run verify:canonical` 校验数量、语言、ID 唯一性、字段必填和两个 SHA-256。
- `StaticCanonicalCorpusContentRepository.verifyIntegrity()` 复用同一摘要并执行
  9,828/5,906/3,922 fail-closed 门禁。
- PWA 以日语/英语动态分片发布，Workbox 预缓存上限为 5 MiB；不把两语资产并入首屏入口
  chunk。
