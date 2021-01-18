type Note = {
  id: number;
  key: string;
  name: string;
  publishAt: Date;
}

type Notes = {
  contents: Note[];
  isLastPage: boolean;
  totalCount: number;
}

type Round = "東" | "南"

type RoundHand = 1 | 2 | 3 | 4

class Hand {
  eastName?: string;
  southName?: string;
  westName?: string;
  northName?: string;
  eastStartPoint?: number;
  southStartPoint?: number;
  westStartPoint?: number;
  northStartPoint?: number;
  eastGetPoint?: number;
  southGetPoint?: number;
  westGetPoint?: number;
  northGetPoint?: number;
  round?: Round;
  hand?: RoundHand;
  homba?: number;
  riichiStick?: number;
  endOfAHand?: string;

  public constructor(public url: string) {
    const decoded = decodeURIComponent(url.split("#json=")[1])
    try {
      const json = JSON.parse(decoded)
      const [eastName, southName, westName, northName] = json.name
      const [
        [roundNumber, homba, riichiStick],
        [eastStartPoint, southStartPoint, westStartPoint, northStartPoint],
        doras,
        uraDoras,
        eastHaipai,
        eastTsumo,
        eastSutepai,
        southHaipai,
        southTsumo,
        southSutepai,
        westHaipai,
        westTsumo,
        westSutepai,
        northHaipai,
        northTsumo,
        northSutepai,
        end,
      ] = json.log[0]
      const endOfAHand = end[0]
      const [
        eastGetPoint, southGetPoint, westGetPoint, northGetPoint
      ] = end.length >= 2 ? end[1] : [0, 0, 0, 0]

      this.eastName = eastName,
      this.southName = southName,
      this.westName = westName,
      this.northName = northName,
      this.eastStartPoint = eastStartPoint,
      this.southStartPoint = southStartPoint,
      this.westStartPoint = westStartPoint,
      this.northStartPoint = northStartPoint,
      this.eastGetPoint = eastGetPoint,
      this.southGetPoint = southGetPoint,
      this.westGetPoint = westGetPoint,
      this.northGetPoint = northGetPoint,
      this.round = this.roundNumber2Round(roundNumber)
      this.hand = this.roundNumber2RoundHand(roundNumber)
      this.homba = homba
      this.riichiStick = riichiStick
      this.endOfAHand = endOfAHand
    } catch (err) {
      Logger.log(`牌譜URLのJSON変換でエラー: ${err}, ${url}, ${decoded}`)
    }
  }

  private roundNumber2Round = (roundNumber: number): Round => {
    switch (roundNumber) {
      case 0:
      case 1:
      case 2:
      case 3:
        return "東"
      case 4:
      case 5:
      case 6:
      case 7:
        return "南" 
      default:
        throw new Error(`不正な局番号:${roundNumber}`);
    }
  }

  private roundNumber2RoundHand = (roundNumber: number): RoundHand => {
    switch (roundNumber) {
      case 0:
      case 4:
        return 1
      case 1:
      case 5:
        return 2
      case 2:
      case 6:
        return 3
      case 3:
      case 7:
        return 4
      default:
        throw new Error(`不正な局番号:${roundNumber}`);
    }
  }

  public eastResultPoint() {
    if (this.eastStartPoint === undefined) {
      return undefined
    }
    return this.eastStartPoint + this.eastGetPoint
  }

  public southResultPoint() {
    if (this.southStartPoint === undefined) {
      return undefined
    }
    return this.southStartPoint + this.southGetPoint
  }

  public westResultPoint() {
    if (this.westStartPoint === undefined) {
      return undefined
    }
    return this.westStartPoint + this.westGetPoint
  }

  public northResultPoint() {
    if (this.northStartPoint === undefined) {
      return undefined
    }
    return this.northStartPoint + this.northGetPoint
  }

  public first() {
    const e = this.eastResultPoint()
    const s = this.southResultPoint()
    const w = this.westResultPoint()
    const n = this.northResultPoint()
    if ((e || e === 0) && (s || s === 0) && (w || w === 0) && (n || n === 0)) {
      const maxPoint = Math.max(e, s, w, n)
      return ([
        [this.eastName, e],
        [this.southName, s],
        [this.westName, w],
        [this.northName, n],
      ] as const).filter(([n, p]) => p === maxPoint).map(([n, p]) => n)
    }
    return undefined
  }
}

type Game = {
  title: string;
  hands: Hand[];
  eastName?: string;
  southName?: string;
  westName?: string;
  northName?: string;
  eastPoint?: number;
  southPoint?: number;
  westPoint?: number;
  northPoint?: number;
  first?: string[];
}

type NoteDetail = Note & {
  body: string;
  game: Game;
}

class NoteRepository {
  public constructor(
    public baseUrl: string,
  ) {}

  public findNotes(page?: number): Notes {
    const res = UrlFetchApp.fetch(`${this.baseUrl}/v2/creators/seppu/contents?kind=note&page=${page || 1}`)
    if (res.getResponseCode() !== 200) {
      throw new Error(`error findNotes fetch note api. ${res.getContentText()}`)
    }
    const json = JSON.parse(res.getContentText())
    return {
      contents: json.data.contents.map(({ id, key, name, publishAt }) => ({
        id, key, name, publishAt: new Date(`${publishAt}+09:00`)
      })),
      isLastPage: json.data.isLastPage,
      totalCount: json.data.totalCount,
    }
  }

  private url2Hand = (url: string): Hand => {
    return new Hand(url)
  }

  public findNoteByKey(key: string): NoteDetail {
    const res = UrlFetchApp.fetch(`${this.baseUrl}/v1/notes/${key}`)
    if (res.getResponseCode() !== 200) {
      throw new Error(`error findNoteById fetch note api. ${res.getContentText()}`)
    }
    const json = JSON.parse(res.getContentText())
    const { id, name, publish_at, body } = json.data
    //TODO URL短縮の場合がある
    const regexp = /https?:\/\/tenhou\.net\/5\/#json=[^"]*"/g
    const urls = Array
      .from((body as string).matchAll(regexp))
      // 最後に「"」があるので除く
      .map(v => v[0].slice(0, -1))
      // 重複削除
      //TODO http, httpsを区別しないようにする
      .filter((v, i, array) => array.indexOf(v) === i)
    const hands = urls.map(this.url2Hand)
    const lastHand = hands.length ? hands[hands.length - 1] : undefined
    const game: Game = {
      title: name,
      hands,
      //TODO 選手名のばらつきを抑える
      eastName: lastHand?.eastName,
      southName: lastHand?.southName,
      westName: lastHand?.westName,
      northName: lastHand?.northName,
      eastPoint: lastHand?.eastResultPoint(),
      southPoint: lastHand?.southResultPoint(),
      westPoint: lastHand?.westResultPoint(),
      northPoint: lastHand?.northResultPoint(),
      first: lastHand?.first()
    }
    return {
      id, key, name,
      publishAt: new Date(publish_at),
      body,
      game,
    }
  }
}

class SheetRepository {
  private notes: GoogleAppsScript.Spreadsheet.Sheet
  private logs: GoogleAppsScript.Spreadsheet.Sheet
  private games: GoogleAppsScript.Spreadsheet.Sheet
  
  public constructor() {
    this.fetchSheet()
  }

  private fetchSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
    this.notes = sheet.getSheetByName("notes")
    if (!this.notes) {
      throw new Error('sheet.notesの取得に失敗')
    }
    this.logs = sheet.getSheetByName("logs")
    if (!this.logs) {
      throw new Error('sheet.logsの取得に失敗')
    }
    this.games = sheet.getSheetByName("games")
    if (!this.games) {
      throw new Error('sheet.gamesの取得に失敗')
    }
  }

  public getNotes(): Note[] {
    const values = this.notes.getRange("A:D").getValues()
    if (values.length === 0) {
      return []
    }
    return values.map(([key, id, name, publishAt]) => ({
      id,
      key,
      name,
      publishAt: new Date(publishAt),
    }))
  }

  public appendNote(note: NoteDetail) {
    this.notes.appendRow([note.key, note.id, note.name, note.publishAt.getTime(), note.body])
    if (note.name.includes("Mリーグ")) {
      note.game.hands.forEach(h => {
        this.logs.appendRow([
          note.name,
          h.url,
          h.round, h.hand, h.homba, h.riichiStick,
          h.eastName, h.southName, h.westName, h.northName,
          h.eastStartPoint, h.southStartPoint, h.westStartPoint, h.northStartPoint,
          h.eastGetPoint, h.southGetPoint, h.westGetPoint, h.northGetPoint,
          h.endOfAHand,
        ])
      })
      
      this.games.appendRow([
        note.game.title,
        note.game.eastName, note.game.southName, note.game.westName, note.game.northName,
        note.game.eastPoint, note.game.southPoint, note.game.westPoint, note.game.northPoint,
        note.game.first?.join(","),
      ])
    }
  }

  public replaceRow(row: any[], rowIdx: number) {
    this.notes.getRange(rowIdx, 0, 1, row.length).setValues(row)
  }
}

const setNoteToSheet = (sheetRepo: SheetRepository, noteRepo: NoteRepository, sheet: Note[], note: Note) => {
  const exists = sheet.find(n => n.key === note.key)
  if (exists) {
    // note.publishAtは分までの情報なので、合わせる
    const existsPublishAt = new Date(
      exists.publishAt.getFullYear(),
      exists.publishAt.getMonth(),
      exists.publishAt.getDate(),
      exists.publishAt.getHours(),
      exists.publishAt.getMinutes(),
    ).getTime()
    if (existsPublishAt === note.publishAt.getTime()) {
      return
    }
  }
  const detail = noteRepo.findNoteByKey(note.key)
  sheetRepo.appendNote(detail)
}

const setNotes = (sheetRepo?: SheetRepository, noteRepo?: NoteRepository, sheet?: Note[], page?: number) => {
  const _sheetRepo = sheetRepo || new SheetRepository()
  const _noteRepo = noteRepo || new NoteRepository(
    PropertiesService.getScriptProperties().getProperty("NOTE_API_BASE")
  )
  const _sheet = sheet || _sheetRepo.getNotes()
  const _page = page || 1
  const notes = _noteRepo.findNotes(_page)
  notes.contents.forEach(n => {
    setNoteToSheet(_sheetRepo, _noteRepo, _sheet, n)
  })
  if (!notes.isLastPage) {
    setNotes(_sheetRepo, _noteRepo, _sheet, _page + 1)
  }
}