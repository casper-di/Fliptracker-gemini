import { Injectable } from '@nestjs/common';
import { ConnectedEmail } from '../../domain/entities';
import { IConnectedEmailRepository } from '../../domain/repositories';

@Injectable()
export class InMemoryConnectedEmailRepository implements IConnectedEmailRepository {
  private emails: Map<string, ConnectedEmail> = new Map();
  private idCounter = 1;

  async findById(id: string): Promise<ConnectedEmail | null> {
    console.log('[InMemoryRepo] Finding email by ID:', id);
    return this.emails.get(id) || null;
  }

  async findByUserId(userId: string): Promise<ConnectedEmail[]> {
    console.log('[InMemoryRepo] Finding emails for userId:', userId);
    const results = Array.from(this.emails.values()).filter(e => e.userId === userId);
    console.log('[InMemoryRepo] Found', results.length, 'email(s)');
    return results;
  }

  async findByEmailAddress(emailAddress: string): Promise<ConnectedEmail | null> {
    console.log('[InMemoryRepo] Finding email by address:', emailAddress);
    return Array.from(this.emails.values()).find(e => e.emailAddress === emailAddress) || null;
  }

  async create(email: Omit<ConnectedEmail, 'id' | 'createdAt'>): Promise<ConnectedEmail> {
    const id = `email_${this.idCounter++}`;
    const createdEmail: ConnectedEmail = {
      id,
      ...email,
      createdAt: new Date(),
    };
    
    this.emails.set(id, createdEmail);
    console.log('[InMemoryRepo] Created email connection:', { id, emailAddress: email.emailAddress, totalEmails: this.emails.size });
    
    return createdEmail;
  }

  async update(id: string, data: Partial<ConnectedEmail>): Promise<ConnectedEmail> {
    const existing = this.emails.get(id);
    if (!existing) {
      throw new Error(`Email connection ${id} not found`);
    }

    const updated = { ...existing, ...data, id };
    this.emails.set(id, updated);
    console.log('[InMemoryRepo] Updated email connection:', id);
    
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.emails.delete(id);
    console.log('[InMemoryRepo] Deleted email connection:', id);
  }
}
