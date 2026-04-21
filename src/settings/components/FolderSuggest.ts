import { AbstractInputSuggest, App, TAbstractFile, TFolder } from 'obsidian';

/**
 * 文件夹路径建议组件
 * 参考 Templater 插件的 FolderSuggest 实现
 * 在设置面板中为路径输入框提供文件夹自动补全
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(
		app: App,
		public inputEl: HTMLInputElement,
	) {
		super(app, inputEl);
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((folder: TAbstractFile) => {
			if (
				folder instanceof TFolder &&
				folder.path.toLowerCase().includes(lowerCaseInputStr)
			) {
				folders.push(folder);
			}
		});

		return folders.slice(0, 1000);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.inputEl.trigger('input');
		this.close();
	}
}
