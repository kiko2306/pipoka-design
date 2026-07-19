import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { catchError, concatMap, from, of, toArray } from 'rxjs';

interface HomepageCopy {
  workEyebrow: string;
  workHeadline: string;
  aboutEyebrow: string;
  aboutHeadline: string;
  aboutDetail: string;
  contactEyebrow: string;
  contactHeadline: string;
  contactDetail: string;
}

interface PublicCollection {
  title: string;
  slug: string;
  note: string;
  image: string | null;
}

interface PublicImage {
  id: string;
  title: string;
  altText: string;
  filePath: string;
  description?: string;
  collectionTitle?: string;
  averageRating: number;
  ratingCount: number;
  visitorRating: number;
  comments?: PublicComment[];
}

interface PublicComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  isOwned: boolean;
  status: 'pending' | 'approved' | 'rejected';
}

type DeleteConfirmation =
  | { type: 'collection'; id: string; title: string }
  | { type: 'image'; id: string; title: string }
  | { type: 'comment'; id: string; imageId: string };

const defaultHomepage: HomepageCopy = {
  workEyebrow: 'Selected collections',
  workHeadline: 'The archive is arranged\nby feeling, not category.',
  aboutEyebrow: 'A little about me',
  aboutHeadline: 'I photograph what changes when nobody is looking: the light after a departure, a mark in sand, a room settling into evening.',
  aboutDetail: 'Pipoka is an independent image practice. The work gathers slowly, across walks, train windows and borrowed time.',
  contactEyebrow: 'Start a conversation',
  contactHeadline: 'Have an idea\nthat needs images?',
  contactDetail: 'For commissions, print enquiries, or simply to say hello.',
};

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly visitorKey = this.getVisitorKey();

  protected readonly darkMode = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly contactSent = signal(false);
  protected readonly selectedImage = signal<string | null>(null);
  protected readonly selectedPublicImage = signal<PublicImage | null>(null);
  protected readonly isAdmin = signal(window.location.pathname === '/admin');
  protected readonly token = signal(localStorage.getItem('pipoka-admin-token'));
  protected readonly adminCollections = signal<Array<{ id: string; title: string; slug: string; description: string; isPublished: boolean; displayOrder: number }>>([]);
  protected readonly pendingComments = signal<Array<{ id: string; authorName: string; body: string; imageTitle: string }>>([]);
  protected readonly contactSubmissions = signal<Array<{ id: string; name: string; email: string; message: string }>>([]);
  protected readonly collectionImages = signal<Array<{ id: string; title: string; altText: string; filePath: string; isPublished: boolean }>>([]);
  protected readonly previewCollectionTitle = signal<string | null>(null);
  protected readonly previewCollectionId = signal<string | null>(null);
  protected readonly publicCollectionTitle = signal<string | null>(null);
  protected readonly publicCollectionError = signal('');
  protected readonly contactError = signal('');
  protected readonly imageActionError = signal('');
  protected readonly publicCollectionImages = signal<PublicImage[]>([]);
  protected readonly displaySiteTitle = signal('Pipoka');
  protected readonly displaySiteSubtitle = signal('Images that make room to look.');
  protected readonly homepage = signal<HomepageCopy>(defaultHomepage);
  protected readonly adminMessage = signal('');
  protected readonly collections = signal<PublicCollection[]>([]);
  protected readonly deleteConfirmation = signal<DeleteConfirmation | null>(null);

  protected loginEmail = '';
  protected loginPassword = '';
  protected collectionTitle = '';
  protected collectionDescription = '';
  protected collectionPublished = false;
  protected editingCollectionId: string | null = null;
  protected siteTitle = 'Pipoka';
  protected siteSubtitle = 'Images that make room to look.';
  protected homepageForm: HomepageCopy = { ...defaultHomepage };
  protected uploadCollectionId = '';
  protected uploadTitle = '';
  protected uploadAltText = '';
  protected uploadDescription = '';
  protected uploadPublished = true;
  protected publicSort: 'date' | 'popularity' = 'date';
  protected activeCollectionSlug: string | null = null;
  protected commentAuthorName = '';
  protected commentBody = '';
  protected editingCommentId: string | null = null;
  protected editingCommentAuthorName = '';
  protected editingCommentBody = '';
  protected contactName = '';
  protected contactEmail = '';
  protected contactMessage = '';
  protected uploadFiles: File[] = [];
  private messageTimeout: ReturnType<typeof setTimeout> | undefined;
  private deletionTrigger: HTMLElement | null = null;
  private settingsLoaded = false;

  protected readonly selected = this.selectedImage.asReadonly();

  ngOnInit() {
    if (this.isAdmin()) {
      if (this.token()) {
        this.loadAdminData();
      }
      return;
    }
    this.loadPublicCollections();
  }

  protected toggleTheme() {
    this.darkMode.update((value) => !value);
  }

  protected toggleMobileNav() {
    this.mobileNavOpen.update((value) => !value);
  }

  protected closeMobileNav() {
    this.mobileNavOpen.set(false);
  }

  protected openImage(image: string) {
    this.selectedImage.set(image);
  }

  protected closeImage() {
    this.selectedImage.set(null);
  }

  protected closePublicImage() {
    this.selectedPublicImage.set(null);
    this.editingCommentId = null;
  }

  protected sendContact() {
    this.contactError.set('');
    this.http.post('/api/contact', {
      name: this.contactName,
      email: this.contactEmail,
      message: this.contactMessage,
    }).subscribe({
      next: () => {
        this.contactSent.set(true);
        this.contactName = '';
        this.contactEmail = '';
        this.contactMessage = '';
      },
      error: (error) => this.contactError.set(this.errorMessage(error, 'Message could not be sent.')),
    });
  }

  protected login() {
    this.adminMessage.set('');
    this.http.post<{ accessToken: string }>('/api/auth/login', {
      email: this.loginEmail,
      password: this.loginPassword
    }).subscribe({
      next: ({ accessToken }) => {
        localStorage.setItem('pipoka-admin-token', accessToken);
        this.token.set(accessToken);
        this.loadAdminData();
      },
      error: () => this.showAdminMessage('O email ou a palavra-passe não foram aceites.')
    });
  }

  protected logout() {
    localStorage.removeItem('pipoka-admin-token');
    this.token.set(null);
    this.adminCollections.set([]);
    this.cancelEdit();
    this.closeCollectionPreview();
    this.settingsLoaded = false;
  }

  protected saveCollection() {
    const collection = {
      title: this.collectionTitle,
      description: this.collectionDescription,
      isPublished: this.collectionPublished
    };
    const request = this.editingCollectionId
      ? this.http.patch(`/api/admin/collections/${this.editingCollectionId}`, collection, { headers: this.adminHeaders() })
      : this.http.post('/api/admin/collections', collection, { headers: this.adminHeaders() });
    request.subscribe({
      next: () => {
        this.cancelEdit();
        this.showAdminMessage('Coleção guardada.');
        this.loadAdminData();
      },
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível guardar a coleção.'))
    });
  }

  protected editCollection(collection: { id: string; title: string; description: string; isPublished: boolean }) {
    this.editingCollectionId = collection.id;
    this.collectionTitle = collection.title;
    this.collectionDescription = collection.description;
    this.collectionPublished = collection.isPublished;
  }

  protected cancelEdit() {
    this.editingCollectionId = null;
    this.collectionTitle = '';
    this.collectionDescription = '';
    this.collectionPublished = false;
  }

  protected requestCollectionDeletion(collection: { id: string; title: string }, event: MouseEvent) {
    this.openDeletionConfirmation({ type: 'collection', id: collection.id, title: collection.title }, event);
  }

  protected requestImageDeletion(image: { id: string; title: string }, event: MouseEvent) {
    this.openDeletionConfirmation({ type: 'image', id: image.id, title: image.title }, event);
  }

  protected requestCommentDeletion(commentId: string, event: MouseEvent) {
    const image = this.selectedPublicImage();
    if (image) {
      this.openDeletionConfirmation({ type: 'comment', id: commentId, imageId: image.id }, event);
    }
  }

  protected cancelDeletion() {
    this.closeDeletionConfirmation();
  }

  protected confirmDeletion() {
    const confirmation = this.deleteConfirmation();
    this.closeDeletionConfirmation();
    if (!confirmation) {
      return;
    }
    switch (confirmation.type) {
      case 'collection':
        this.deleteCollection(confirmation.id);
        break;
      case 'image':
        this.deleteImage(confirmation.id);
        break;
      case 'comment':
        this.deleteComment(confirmation.id, confirmation.imageId);
        break;
    }
  }

  protected keepDeletionFocus(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.confirmation-dialog button'));
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (keyboardEvent.shiftKey && currentIndex <= 0) {
      keyboardEvent.preventDefault();
      buttons.at(-1)?.focus();
    } else if (!keyboardEvent.shiftKey && currentIndex === buttons.length - 1) {
      keyboardEvent.preventDefault();
      buttons[0]?.focus();
    }
  }

  private deleteCollection(collectionId: string) {
    this.http.delete(`/api/admin/collections/${collectionId}`, { headers: this.adminHeaders() }).subscribe({
      next: () => {
        if (this.previewCollectionId() === collectionId) {
          this.closeCollectionPreview();
        }

        if (this.editingCollectionId === collectionId) {
          this.cancelEdit();
        }
        this.showAdminMessage('Coleção removida.');
        this.loadAdminData();
      },
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível remover a coleção.'))
    });
  }

  private openDeletionConfirmation(confirmation: DeleteConfirmation, event: MouseEvent) {
    this.deletionTrigger = event.currentTarget as HTMLElement;
    this.deleteConfirmation.set(confirmation);
    queueMicrotask(() => document.querySelector<HTMLButtonElement>('.confirmation-dialog button')?.focus());
  }

  private closeDeletionConfirmation() {
    this.deleteConfirmation.set(null);
    const trigger = this.deletionTrigger;
    this.deletionTrigger = null;
    queueMicrotask(() => trigger?.focus());
  }

  protected moveCollection(index: number, direction: -1 | 1) {
    const collections = [...this.adminCollections()];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= collections.length) {
      return;
    }
    [collections[index], collections[targetIndex]] = [collections[targetIndex], collections[index]];
    this.adminCollections.set(collections);
    this.http.patch('/api/admin/collections/order', { collectionIds: collections.map(({ id }) => id) }, { headers: this.adminHeaders() })
      .subscribe({
        next: () => this.showAdminMessage('Ordem das coleções guardada.'),
        error: () => {
          this.showAdminMessage('Não foi possível guardar a ordem das coleções.');
          this.loadAdminData();
        }
      });
  }

  protected previewCollection(collection: { id: string; title: string }) {
    this.http.get<Array<{ id: string; title: string; altText: string; filePath: string; isPublished: boolean }>>(
      `/api/admin/collections/${collection.id}/images`,
      { headers: this.adminHeaders() }
    ).subscribe({
      next: (images) => {
        this.previewCollectionTitle.set(collection.title);
        this.previewCollectionId.set(collection.id);
        this.collectionImages.set(images);
      },
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível carregar as imagens desta coleção.'))
    });
  }

  protected closeCollectionPreview() {
    this.previewCollectionTitle.set(null);
    this.previewCollectionId.set(null);
    this.collectionImages.set([]);
  }

  private deleteImage(imageId: string) {
    this.http.delete(`/api/admin/images/${imageId}`, { headers: this.adminHeaders() }).subscribe({
      next: () => {
        this.collectionImages.update((images) => images.filter(({ id }) => id !== imageId));
        this.showAdminMessage('Imagem removida.');
        this.loadAdminData();
      },
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível remover a imagem.'))
    });
  }

  protected selectUploadFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.uploadFiles = input.files ? Array.from(input.files) : [];
  }

  protected uploadImages(fileInput: HTMLInputElement) {
    if (!this.uploadCollectionId) {
      this.showAdminMessage('Selecione uma coleção antes de carregar imagens.');
      return;
    }
    if (this.uploadFiles.length === 0) {
      this.showAdminMessage('Selecione uma imagem antes de carregar.');
      return;
    }
    const failedUploads: string[] = [];
    from(this.uploadFiles).pipe(
      concatMap((file) => {
        const data = new FormData();
        data.append('file', file);
        data.append('collectionId', this.uploadCollectionId);
        data.append('title', this.uploadTitle || file.name.replace(/\.[^.]+$/, ''));
        data.append('altText', this.uploadAltText || file.name);
        data.append('description', this.uploadDescription);
        data.append('isPublished', String(this.uploadPublished));
        return this.http.post('/api/admin/images/upload', data, { headers: this.adminHeaders() }).pipe(
          catchError((error) => {
            failedUploads.push(`${file.name}: ${this.errorMessage(error, 'erro no carregamento')}`);
            return of(null);
          }),
        );
      }),
      toArray()
    ).subscribe({
      next: () => {
        this.uploadTitle = '';
        this.uploadAltText = '';
        this.uploadDescription = '';
        this.uploadFiles = [];
        fileInput.value = '';
        this.showAdminMessage(failedUploads.length
          ? `${failedUploads.length} imagem(ns) não foram carregadas. ${failedUploads.join(' ')}`
          : this.uploadPublished ? 'Imagens carregadas e publicadas.' : 'Imagens carregadas como rascunho.');
        this.loadAdminData();
        const previewId = this.previewCollectionId();
        if (previewId === this.uploadCollectionId) {
          const collection = this.adminCollections().find(({ id }) => id === previewId);
          if (collection) {
            this.previewCollection(collection);
          }
        }
      },
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível carregar a imagem.'))
    });
  }

  protected moderateComment(id: string, status: 'approved' | 'rejected') {
    this.http.patch(`/api/admin/comments/${id}`, { status }, { headers: this.adminHeaders() }).subscribe({
      next: () => this.loadAdminData(),
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível atualizar o comentário.'))
    });
  }

  protected saveHomepage() {
    this.http.patch('/api/admin/settings/homepage', this.homepageForm, { headers: this.adminHeaders() }).subscribe({
      next: () => this.showAdminMessage('Textos da página guardados.'),
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível guardar os textos.'))
    });
  }

  protected saveIdentity() {
    this.http.patch('/api/admin/settings/identity', { siteTitle: this.siteTitle, siteSubtitle: this.siteSubtitle }, { headers: this.adminHeaders() }).subscribe({
      next: () => this.showAdminMessage('Título e subtítulo guardados.'),
      error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível guardar o título e subtítulo.'))
    });
  }

  protected changePublicSort(value: string) {
    this.publicSort = value === 'popularity' ? 'popularity' : 'date';
    if (this.activeCollectionSlug) {
      this.openPublicCollection(this.activeCollectionSlug);
    }
  }

  protected openPublicCollection(slug: string) {
    this.activeCollectionSlug = slug;
    this.publicCollectionError.set('');
    this.http.get<{ title: string; images: PublicImage[] }>(`/api/collections/${slug}?sort=${this.publicSort}`, { headers: this.visitorHeaders() })
      .subscribe({
        next: (collection) => {
          this.publicCollectionTitle.set(collection.title);
          this.publicCollectionImages.set(collection.images);
        },
        error: (error) => {
          this.publicCollectionTitle.set(null);
          this.publicCollectionImages.set([]);
          this.publicCollectionError.set(this.errorMessage(error, 'This collection could not be loaded.'));
        }
      });
  }

  protected closePublicCollection() {
    this.publicCollectionTitle.set(null);
    this.publicCollectionImages.set([]);
    this.publicCollectionError.set('');
    this.activeCollectionSlug = '';
  }

  protected openPublicImage(imageId: string) {
    this.imageActionError.set('');
    this.loadPublicImage(imageId, true);
  }

  protected ratePublicImage(value: number) {
    const image = this.selectedPublicImage();
    if (!image) {
      return;
    }
    this.imageActionError.set('');
    this.http.post<{ value: number; averageRating: number; ratingCount: number }>(
      `/api/images/${image.id}/ratings`,
      { value },
      { headers: this.visitorHeaders() }
    ).subscribe({
      next: (rating) => {
        this.imageActionError.set('');
        this.selectedPublicImage.update((current) => current && ({
          ...current,
          visitorRating: rating.value,
          averageRating: Number(rating.averageRating),
          ratingCount: Number(rating.ratingCount),
        }));
        this.updateGalleryRating(image.id, rating);
      },
      error: (error) => this.imageActionError.set(this.errorMessage(error, 'Rating could not be saved.')),
    });
  }

  protected submitComment() {
    const image = this.selectedPublicImage();
    if (!image) {
      return;
    }
    this.imageActionError.set('');
    this.http.post(`/api/images/${image.id}/comments`, {
      authorName: this.commentAuthorName,
      body: this.commentBody,
    }, { headers: this.visitorHeaders() }).subscribe({
      next: () => {
        this.imageActionError.set('Your comment was sent for approval and will appear publicly after an administrator reviews it.');
        this.commentBody = '';
        this.loadPublicImage(image.id, false);
      },
      error: (error) => this.imageActionError.set(this.errorMessage(error, 'Comment could not be saved.')),
    });
  }

  protected startCommentEdit(comment: PublicComment) {
    this.editingCommentId = comment.id;
    this.editingCommentAuthorName = comment.authorName;
    this.editingCommentBody = comment.body;
  }

  protected cancelCommentEdit() {
    this.editingCommentId = null;
    this.editingCommentAuthorName = '';
    this.editingCommentBody = '';
  }

  protected saveCommentEdit() {
    const image = this.selectedPublicImage();
    if (!image || !this.editingCommentId) {
      return;
    }
    this.imageActionError.set('');
    this.http.patch(`/api/comments/${this.editingCommentId}`, {
      authorName: this.editingCommentAuthorName,
      body: this.editingCommentBody,
    }, { headers: this.visitorHeaders() }).subscribe({
      next: () => {
        this.imageActionError.set('');
        this.cancelCommentEdit();
        this.loadPublicImage(image.id, false);
      },
      error: (error) => this.imageActionError.set(this.errorMessage(error, 'Comment could not be updated.')),
    });
  }

  private deleteComment(commentId: string, imageId: string) {
    this.imageActionError.set('');
    this.http.delete(`/api/comments/${commentId}`, { headers: this.visitorHeaders() }).subscribe({
      next: () => {
        this.imageActionError.set('');
        this.loadPublicImage(imageId, false);
      },
      error: (error) => this.imageActionError.set(this.errorMessage(error, 'Comment could not be deleted.')),
    });
  }

  private loadAdminData() {
    const options = { headers: this.adminHeaders() };
    this.http.get<Array<{ id: string; title: string; slug: string; description: string; isPublished: boolean; displayOrder: number }>>('/api/admin/collections', options)
      .subscribe({
        next: (collections) => {
          this.adminCollections.set(collections);
          if (!this.uploadCollectionId || !collections.some(({ id }) => id === this.uploadCollectionId)) {
            this.uploadCollectionId = collections[0]?.id ?? '';
          }
        },
        error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível carregar as coleções.')),
      });
    this.http.get<Array<{ id: string; authorName: string; body: string; imageTitle: string }>>('/api/admin/comments', options)
      .subscribe((comments) => this.pendingComments.set(comments));
    this.http.get<Array<{ id: string; name: string; email: string; message: string }>>('/api/admin/contact-submissions', options)
      .subscribe((submissions) => this.contactSubmissions.set(submissions));
    if (!this.settingsLoaded) {
      this.http.get<{ siteTitle: string; siteSubtitle: string; homepage: HomepageCopy }>('/api/admin/settings', options)
        .subscribe({
          next: (settings) => {
            this.siteTitle = settings.siteTitle;
            this.siteSubtitle = settings.siteSubtitle;
            this.homepageForm = { ...defaultHomepage, ...settings.homepage };
            this.settingsLoaded = true;
          },
          error: (error) => this.showAdminMessage(this.errorMessage(error, 'Não foi possível carregar os textos do site.')),
        });
    }
  }

  private loadPublicCollections() {
    this.http.get<{ collections: Array<{ title: string; slug: string; description: string; coverImage: string | null }>; siteTitle: string; siteSubtitle: string; homepage: HomepageCopy }>('/api/home')
      .subscribe({
        next: ({ collections, siteTitle, siteSubtitle, homepage }) => {
          this.displaySiteTitle.set(siteTitle);
          this.displaySiteSubtitle.set(siteSubtitle);
          this.homepage.set({ ...defaultHomepage, ...homepage });
          this.collections.set(collections.map((collection) => ({
            title: collection.title,
            slug: collection.slug,
            note: collection.description,
            image: collection.coverImage,
          })));
        },
        error: (error) => this.showPublicError(this.errorMessage(error, 'The archive could not be loaded.')),
      });
  }

  private loadPublicImage(imageId: string, open: boolean) {
    this.http.get<PublicImage>(`/api/images/${imageId}`, { headers: this.visitorHeaders() }).subscribe({
      next: (image) => {
        this.selectedPublicImage.set(image);
        if (open) {
          this.selectedImage.set(null);
        }
      },
      error: (error) => this.publicCollectionError.set(this.errorMessage(error, 'This image could not be loaded.')),
    });
  }

  private updateGalleryRating(imageId: string, rating: { value: number; averageRating: number; ratingCount: number }) {
    this.publicCollectionImages.update((images) => images.map((image) => image.id === imageId
      ? { ...image, visitorRating: rating.value, averageRating: Number(rating.averageRating), ratingCount: Number(rating.ratingCount) }
      : image));
  }

  private adminHeaders() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token()}` });
  }

  private visitorHeaders() {
    return new HttpHeaders({ 'x-visitor-key': this.visitorKey });
  }

  private getVisitorKey() {
    const stored = localStorage.getItem('pipoka-visitor-key');
    if (stored && stored.length >= 16) {
      return stored;
    }
    const key = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}-${Math.random()}`;
    localStorage.setItem('pipoka-visitor-key', key);
    return key;
  }

  private errorMessage(error: unknown, fallback: string) {
    return error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message
      : fallback;
  }

  private showPublicError(message: string) {
    this.publicCollectionError.set(message);
  }

  private showAdminMessage(message: string) {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    this.adminMessage.set(message);
    this.messageTimeout = setTimeout(() => this.adminMessage.set(''), 5000);
  }
}
