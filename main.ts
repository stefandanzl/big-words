import {
	Plugin,
	MarkdownView,
	WorkspaceLeaf,
	PluginSettingTab,
	App,
	Setting,
	Editor,
	MarkdownFileInfo,
} from "obsidian";

interface WordCountPluginSettings {
	countOnlyActualWords: boolean;
	excludeFrontmatter: boolean;
}

const DEFAULT_SETTINGS: WordCountPluginSettings = {
	countOnlyActualWords: true,
	excludeFrontmatter: true,
};

export default class WordCountPlugin extends Plugin {
	settings: WordCountPluginSettings;
	statusBarItem: HTMLElement;

	async onload(): Promise<void> {
		console.log("Loading Word Count plugin");

		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new WordCountSettingTab(this.app, this));

		// Create status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.setText("Words: 0");

		// Register event handlers
		this.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				(leaf: WorkspaceLeaf | null) => {
					this.updateWordCount();
				}
			)
		);

		this.registerEvent(
			this.app.workspace.on(
				"editor-change",
				(editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
					this.updateWordCount();
				}
			)
		);

		// Register editor-related event handlers
		this.registerDomEvent(document, "selectionchange", (evt: Event) => {
			// This DOM event triggers whenever selection changes anywhere in the document
			this.updateWordCount();
		});

		// Initial update
		this.updateWordCount();
	}

	onunload(): void {
		console.log("Unloading Word Count plugin");
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	updateWordCount(): void {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (!activeView) {
			// No active markdown view
			this.statusBarItem.setText("No editor");
			return;
		}

		const editor: Editor = activeView.editor;
		const selection: string = editor.getSelection();
		// const selection: string | undefined =
		// 	this.app.workspace.activeEditor?.editor?.getSelection();
		// Check if there's a selection
		if (selection && selection.trim().length > 0) {
			const wordCount: number = this.countWords(selection);
			this.statusBarItem.setText(`${wordCount} words`);
		} else {
			// Get the full document text
			let text: string = editor.getValue();

			// Remove frontmatter if setting enabled
			if (this.settings.excludeFrontmatter) {
				text = this.removeFrontMatter(text);
			}

			const wordCount: number = this.countWords(text);
			this.statusBarItem.setText(`${wordCount} words`);
		}
	}

	countWords(text: string): number {
		if (this.settings.countOnlyActualWords) {
			// Split on whitespace and filter to only include "actual words" with at least one letter
			const hasLetter = /[a-zA-ZÀ-ÿ]/; // Unicode range for most Latin letters with diacritics
			const words: string[] = text
				.split(/\s+/)
				.filter((word: string) => hasLetter.test(word));
			return words.length;
		} else {
			// Simple word count (anything separated by whitespace)
			return text.split(/\s+/).filter((word: string) => word.length > 0)
				.length;
		}
	}

	removeFrontMatter(text: string): string {
		// Check for frontmatter delimited by --- at the start of the file
		const frontMatterRegex = /^---\s*\n(?:.*\n)*?---\s*\n/m;
		return text.replace(frontMatterRegex, "");
	}
}

class WordCountSettingTab extends PluginSettingTab {
	plugin: WordCountPlugin;

	constructor(app: App, plugin: WordCountPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Word Count Settings" });

		new Setting(containerEl)
			.setName("Count only actual words")
			.setDesc(
				"Only count strings containing at least one letter (a-z, A-Z, accented characters, etc.)"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.countOnlyActualWords)
					.onChange(async (value: boolean) => {
						this.plugin.settings.countOnlyActualWords = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					})
			);

		new Setting(containerEl)
			.setName("Exclude frontmatter")
			.setDesc("Do not count words in YAML frontmatter")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.excludeFrontmatter)
					.onChange(async (value: boolean) => {
						this.plugin.settings.excludeFrontmatter = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					})
			);
	}
}
